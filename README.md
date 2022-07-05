# pm2-discord-plus

This is an improved PM2 Module for sending events & logs from your PM2 processes to Discord.

## Install

To install and setup pm2-discord-plus, run the following commands:

```text
pm2 install JamesNZL/pm2-discord-plus
pm2 set pm2-discord-plus:discord_url https://discord_url
```

#### `discord_url`

To get the Discord URL, you need to setup a Discord webhook.
> Follow [this guide](https://support.discordapp.com/hc/en-us/articles/228383668-Intro-to-Webhooks) if you need help.

## Configure

The following events can be subscribed to:

| Event                 | Description                                                                   | Default |
| --------------------- | ----------------------------------------------------------------------------- | ------- |
| **log**               | All standard out logs from your processes.                                    | `true`  |
| **error**             | All error logs from your processes.                                           | `false` |
| **kill**              | Event fired when PM2 is killed.                                               | `true`  |
| **exception**         | Any exceptions from your processes.                                           | `true`  |
| **restart**           | Event fired when a process is restarted.                                      | `false` |
| **delete**            | Event fired when a process is removed from PM2.                               | `false` |
| **stop**              | Event fired when a process is stopped.                                        | `true`  |
| **restart overlimit** | Event fired when a process is reaches the max amount of times it can restart. | `true`  |
| **exit**              | Event fired when a process is exited.                                         | `false` |
| **start**             | Event fired when a process is started.                                        | `false` |
| **online**            | Event fired when a process is online.                                         | `false` |

You can turn these on/off by setting them to `true` or `false` using the `pm2 set` command.

```text
pm2 set pm2-discord-plus:log true
pm2 set pm2-discord-plus:error false
.
.
.
```

## Options

The following options are available:
| Option             | Type    | Description                                                                                                                                                              | Default                           |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| **process_name**   | string  | Use this to setting to only output the logs of a specific process                                                                                                        | `Default: NULL`                   |
| **buffer**         | boolean | Whether to buffer messages by timestamp. Messages that occur within `buffer_seconds` of each other will be concatenated and posted together in a single Discord message. | `Default: true`                   |
| **buffer_seconds** | int     | Number of seconds within which to aggregate messages. Ignored if `buffer` is `false`.                                                                                    | `Min: 1, Max: 5, Default: 1`      |
| **queue_max**      | int     | Maximum number of messages to keep in the queue before truncation. When the queue exceeds this maximum, a rate limit message will be posted to Discord.                  | `Min: 10, Max: 100, Default: 100` |

Set these options in the same way you subscribe to events.

Example: The following configuration options will enable message buffering, and set the buffer duration to 2 seconds. All messages that occur within 2 seconds of each other (for the same event) will be concatenated into a single Discord message.

```text
pm2 set pm2-discord-plus:process_name myprocess
pm2 set pm2-discord-plus:buffer true
pm2 set pm2-discord-plus:buffer_seconds 2
pm2 set pm2-discord-plus:queue_max 50
```

## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.

## Acknowledgements

This is a fork of [Naxey/pm2-discord-plus](https://github.com/Naxey/pm2-discord-plus), which is forked in turn from [FranciscoG/pm2-discord](https://github.com/FranciscoG/pm2-discord) and [mattpker/pm2-slack](https://github.com/mattpker/pm2-slack).
