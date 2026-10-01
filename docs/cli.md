# CLI

Look up every option of the `simscope` command.

Run `simscope --help` for the command list, or `simscope COMMAND --help` for one command. Every command takes the library folder as its first argument. `serve` needs the `viewer` extra. The other commands do not.

## Exit status

| Status | When |
| --- | --- |
| 0 | The command finished |
| 1 | A problem you can fix, such as a missing rollout. One line on stderr, prefixed `simscope: error:` |
| 2 | A usage error |
| 130 | Interrupted |

## simscope serve

Opens the library in a browser. Runs that are still recording appear, and the app tails their finished blocks.

```bash
simscope serve DIR [--host HOST] [--port PORT] [--author NAME]
```

| Option | What it does | Default |
| --- | --- | --- |
| `DIR` | The library folder | required |
| `--host` | The interface to bind | `127.0.0.1` |
| `--port` | The TCP port, from 0 to 65535 | `8080` |
| `--author` | The author stored on new annotations | unset |

## simscope ls

Lists rollouts.

```bash
simscope ls DIR [--tag TAG] [--favorite] [--status STATUS] [--sort KEY] [--limit N] [--json]
```

| Option | What it does | Default |
| --- | --- | --- |
| `--tag` | Requires a tag. Repeat the flag to require several | none |
| `--favorite` | Lists pinned rollouts. The app calls this Pin | off |
| `--status` | `recording`, `complete`, or a curation status | any |
| `--sort` | `created`, `name`, `n_frames`, or `rating`. Name sorts ascending. The others sort descending | `created` |
| `--limit` | At most this many rollouts | all |
| `--json` | Prints one JSON object per line | table |

An empty library prints `no rollouts` on stderr and still exits 0.

## simscope export

Writes one offline HTML file. See [Exports](getting-started.md#exports).

```bash
simscope export DIR RUN [RUN ...] -o OUT.html [OPTIONS]
```

| Option | What it does | Default |
| --- | --- | --- |
| `RUN` | One or more rollout names. Compare accepts at most four | required |
| `-o`, `--output` | The HTML file to write | required |
| `--ui` | `lean` is the player page. `full` is the whole app, including highlights | `lean` |
| `--layout` | `single`, `grid`, or `compare` | `single` for one rollout, otherwise `grid` |
| `--arrange` | Compare panes: `side`, `stack`, or `grid`. Requires `--layout compare` | `side` for two rollouts, `grid` for three or four |
| `--title` | The page title | the rollout names |
| `--envs` | Comma-separated env indices to include | all envs |
| `--no-transcode` | Keeps the stored blocks instead of transcoding them for the pack | transcode |
| `--no-annotations` | Leaves notes, ratings, and events out of the file | include them |

## simscope rename

Renames a rollout. The folder name changes. The id does not, so notes, ratings, groups, and cached highlights stay with it. A rollout that is still recording cannot be renamed, and the new name must be free. Reopen any `Rollout` you opened before the rename.

```bash
simscope rename DIR OLD NEW
```

## simscope pack

Writes rollouts to a `.simscope` pack. The HTML export embeds this same pack.

```bash
simscope pack DIR RUN [RUN ...] -o OUT.simscope [--no-transcode] [--no-annotations]
```

## simscope import

Imports `.rbundle` files and Brax HTML viewers. A folder is searched for those files.

```bash
simscope import DIR PATH [PATH ...] [--tag TAG] [--overwrite] [--jobs N]
```

| Option | What it does | Default |
| --- | --- | --- |
| `PATH` | A file or a folder | required |
| `--tag` | Adds a tag to each imported rollout. Repeat the flag to add several | none |
| `--overwrite` | Replaces a rollout that already uses the name | off |
| `--jobs` | Worker processes | one |

A file that cannot be read is skipped and reported. If every file fails, the command exits 1.

## simscope recover

Repairs a rollout whose recording stopped before the manifest was finalized. Complete blocks are kept. Frames that exist on a longer stream and not on a shorter one are dropped.

```bash
simscope recover DIR RUN
```

## simscope info

Prints the manifest of one rollout: id, frame count, env count, timestep, source, tags, and each stream.

```bash
simscope info DIR RUN
```
