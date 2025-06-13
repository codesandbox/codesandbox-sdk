# Shell Protocol

The shell protocol allows users to open shells on the remote machine. This is useful for multiple use cases, the main ones we focus are:

1. Running a command (eg. `yarn` or `yarn dev`)
2. Creating an interactive terminal (eg. `/bin/bash`)

The challenge and interesting part of this shell interface is that it's built to be shared with other users. You can give others access to your terminal, you can give others access to write or read from your terminal. This API is built to be collaborative by default.
An inspiration here is [`tmux`](https://github.com/tmux/tmux), `tmux` allows users to create as many terminal windows as they'd like in a single session, and everyone can control and share those terminal windows

In the first version I'm describing here we won't take users into account. That's the direct next steps as we create the users provider.

## Common

These are all common types used across the different requests/notifications/responses.

```ts
/**
 * A shell id should be globally unique for the Pitcher Server as they can be shared between different users. To be safe
 * we should refrain from re-using existing shell ids.
 */
type ShellId = Cuid;

/**
 * The shell size is the number of rows and columns on which the shell content renders
 */
type ShellSize = { cols: number; rows: number };

/**
 * There are two types of shells, commands and terminals. They have slightly different fields, but they also share a common interface.
 * A shell can be in one of the three states (status): RUNNING, FINISHED, ERRORED.
 * We use DTO (data-transfer-object) here to differentiate between the entities passed by the protocol and the internal interfaces/classes used by pitcher.
 * Shells prefixed with `Open` have the content also returned and ready to be displayed.
 */
type BaseShellDTO = {
  shellId: ShellId;
  name: string;
  status: ShellProcessStatus;
  exitCode?: number;
};

export type CommandShellDTO = BaseShellDTO & {
  shellType: "COMMAND";
  startCommand: string;
};

export type TerminalShellDTO = BaseShellDTO & {
  shellType: "TERMINAL";
  ownerUsername: string;
};

export type ShellDTO = CommandShellDTO | TerminalShellDTO;

export type OpenCommandShellDTO = CommandShellDTO & {
  buffer: string[];
};

export type OpenTerminalShellDTO = TerminalShellDTO & {
  buffer: string[];
};

export type OpenShellDTO = OpenCommandShellDTO | OpenTerminalShellDTO;
```

## Requests

### shell/create

Used to create a shell. If it receives a `command` it will run a `COMMAND` type shell, which runs that command until terminated or until an exit code is issued. If it doesn't receive a `command`, it will run a `TERMINAL` type shell, in which the user can type in any command. The `size` is optional, as the client might not know it when the `shell/create` is issued.

Input params;

```
cwd?: string;
command?: string;
size?: ShellSize;
```

Returns an object of type `OpenShellDTO`.

### shell/list

Get the list of all running shells.

Returns an array of `ShellDTO`s.

### shell/open

Used to connect to the stdio of a shell with the specified shell id. After calling this, you will get the last 10000 rows (in `utf-8`) of the specified shell, and you'll get notifications afterwards for all output on stderr and stdout.

Input params

```
shellId: ShellId;
size: ShellSize;
```

Returns an object of type `OpenShellDTO`.

### shell/resize

This can only be called by the creator of the shell.

Input params

```
shellId: ShellId;
size: ShellSize;
```

No return type.

### shell/in

Used to send input to a shell. The `size` will dictate how the content of the shell gets rendered after the user inputs the command. `shell/in` should only be called for TERMINAL type shells.

```ts
shellId: ShellId;
input: string;
size: ShellSize;
```

No return type.

### shell/restart

Kills the current process (if it is running) and restarts it with the same input parameters as the original `create` request.

Input: `shellId`.

No return type.

### shell/terminate

Kills the running process and removes the shell from pitcher.

Input: `shellId`.

No return type.

## Notifications

Notifications are sent to pitcher clients as events. `pitcher-client` will listen to these notifications and call a listener accordingly.

### shell/out

Whenever a shell has output, it will send it to all subscribed clients using this notification.

```
shellId: ShellId;
out: string; // in utf-8
```

### shell/create

Whenever a shell is created, other subscribed clients will receive this notification.

```
shell: ShellDTO;
```

### shell/exit

Whenever the process behind a shell exits, this notification will be sent. An exit code will be provided as well.

```
shellId: ShellId;
exitCode: number;
```

### shell/restart

Whenever the shell is explicitly restarted, a notification is sent to update the status for all other clients.

```
shellId: ShellId;
```

### shell/terminate

Whenever the shell is explicitly terminated/killed, a notification is sent to all subscribed clients.

```
shellId: ShellId;
```
