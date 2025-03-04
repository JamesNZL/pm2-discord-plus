'use strict';
var pm2 = require('pm2');
var pmx = require('pmx');
var request = require('request');
var stripAnsi = require('strip-ansi');
var dateFormat = require('dateformat');

var config = require('./config.json');

// Get the configuration from PM2
var conf = pmx.initModule();

// initialize buffer and queue_max opts
// buffer seconds can be between 1 and 5
conf.buffer_seconds = (conf.buffer_seconds > 0 && conf.buffer_seconds < 5) ? conf.buffer_seconds : 1;

// queue max can be between 10 and 100
conf.queue_max = (conf.queue_max > 10 && conf.queue_max <= 100) ? conf.queue_max : 100;

// create the message queue
var messages = [];

// create the suppressed object for sending suppression messages
var suppressed = {
  isSuppressed: false,
  date: new Date().getTime()
};


// Function to send event to Discord's Incoming Webhook
function sendToDiscord(message) {

  var description = message.description;
  var dateTime = dateFormat(message.timestamp * 1000, conf.date_format || 'default');

  // If a Discord URL is not set, we do not want to continue and notify the user that it needs to be set
  if (!conf.discord_url) {
    return console.error("There is no Discord URL set, please set the Discord URL: 'pm2 set pm2-discord-plus:discord_url https://[discord_url]'");
  }

  // Select the webhook profile image based on the process type
  var configKey;

  switch (message.event) {
    case 'log': configKey = 'console'; break;
    case 'error': configKey = 'error'; break;
    case 'info': configKey = 'info'; break;
    case 'success': configKey = 'success'; break;
    case 'suppressed': configKey = 'warning'; break;
    default: configKey = 'console';
  }

  var profile_url = config.image_url + config.image[configKey];

  // select the codeblock language dynamically
  var codeLanguage;

  try {
    JSON.parse(description.replaceAll('\n', ''));
    // if description can be parsed as json, use json highlighting
    codeLanguage = 'json';
  }
  catch {
    // if description cannot be parsed as json, use js highlighting
    codeLanguage = 'js';
  }

  // The JSON payload to send to the Webhook
  var payload = {
    embeds: [
      {
        description: '```' + codeLanguage + '\n' + description + '```',
        // get the corresponding colour configuration and get its base10 representation
        color: parseInt(config.color[configKey].replace('#', ''), 16),
        author: {
          name: conf.embed_name || message.name,
          icon_url: profile_url
        },
        footer: {
          text: dateTime,
          icon_url: conf.embed_footer_icon || undefined
        }
      }
    ]
  };

  // Options for the post request
  var options = {
    method: 'post',
    body: payload,
    json: true,
    url: conf.discord_url
  };

  // Finally, make the post request to the Discord Incoming Webhook
  request(options, function (err, res) {
    if (err) {
      return console.error(err);
    }
    /* A successful POST to Discord's webhook responds with a 204 NO CONTENT */
    if (res.statusCode !== 204) {
      console.error('Error occurred during the request to the Discord webhook');
    }
  });
}

// Function to get the next buffer of messages (buffer length = 1s)
function bufferMessage() {
  var nextMessage = messages.shift();

  if (!conf.buffer) { return nextMessage; }

  nextMessage.buffer = [nextMessage.description];

  // continue shifting elements off the queue while they are the same event and 
  // timestamp so they can be buffered together into a single request
  while (messages.length &&
    (messages[0].timestamp >= nextMessage.timestamp &&
      messages[0].timestamp < (nextMessage.timestamp + conf.buffer_seconds)) &&
    messages[0].event === nextMessage.event) {

    // append description to our buffer and shift the message off the queue and discard it
    nextMessage.buffer.push(messages[0].description);
    messages.shift();
  }

  // join the buffer with newlines
  nextMessage.description = nextMessage.buffer.join('\n');

  // delete the buffer from memory
  delete nextMessage.buffer;

  return nextMessage;
}

// Function to process the message queue
function processQueue() {

  // If we have a message in the message queue, removed it from the queue and send it to discord
  if (messages.length > 0) {
    sendToDiscord(bufferMessage());
  }

  // If there are over conf.queue_max messages in the queue, send the suppression message if it has not been sent and delete all the messages in the queue after this amount (default: 100)
  if (messages.length > conf.queue_max) {
    if (!suppressed.isSuppressed) {
      suppressed.isSuppressed = true;
      suppressed.date = new Date().getTime();
      sendToDiscord({
        name: 'pm2-discord-plus',
        event: 'suppressed',
        description: 'Messages are being suppressed due to rate limiting.',
        timestamp: Math.floor(Date.now() / 1000)
      });
    }
    messages.splice(conf.queue_max, messages.length);
  }

  // If the suppression message has been sent over 1 minute ago, we need to reset it back to false
  if (suppressed.isSuppressed && suppressed.date < (new Date().getTime() - 60000)) {
    suppressed.isSuppressed = false;
  }

  // Wait 10 seconds and then process the next message in the queue
  setTimeout(function () {
    processQueue();
  }, 10000);
}

function createMessage(data, eventName, altDescription) {
  // we don't want to output pm2-discord-plus's logs
  if (data.process.name === 'pm2-discord-plus') {
    return;
  }
  // if a specific process name was specified then we check to make sure only 
  // that process gets output
  if (conf.process_name !== null && data.process.name !== conf.process_name) {
    return;
  }

  var msg = altDescription || data.data;
  if (typeof msg === 'object') {
    msg = JSON.stringify(msg);
  }

  messages.push({
    name: data.process.name,
    event: eventName,
    description: stripAnsi(msg),
    timestamp: Math.floor(Date.now() / 1000)
  });
}

// Start listening on the PM2 BUS
pm2.launchBus(function (err, bus) {

  // Listen for process logs
  if (conf.log) {
    bus.on('log:out', function (data) {
      createMessage(data, 'log');
    });
  }

  // Listen for process errors
  if (conf.error) {
    bus.on('log:err', function (data) {
      createMessage(data, 'error');
    });
  }

  // Listen for PM2 kill
  if (conf.kill) {
    bus.on('pm2:kill', function (data) {
      messages.push({
        name: 'PM2',
        event: 'kill',
        description: data.msg,
        timestamp: Math.floor(Date.now() / 1000)
      });
    });
  }

  // Listen for process exceptions
  if (conf.exception) {
    bus.on('process:exception', function (data) {
      createMessage(data, 'exception');
    });
  }

  // Listen for PM2 events
  bus.on('process:event', function (data) {
    if (!conf[data.event]) { return; }
    var msg = "'" + data.event + "' event on process '" + data.process.name + "'";
    createMessage(data, data.event, msg);
  });

  // Start the message processing
  processQueue();

});
