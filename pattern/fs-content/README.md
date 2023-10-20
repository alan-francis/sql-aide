# File System Content (`fs-content`)

This SQLite-based pattern provides tables and queries which collectively manage
and store content and metadata related to files, MIME types, devices, and file
system content walk sessions. They include various fields for timestamps, user
information, and JSON data for additional details and elaboration.

- `stored_notebook_cell`: Stores SQL (called _SQL notebook cells_) or other
  interpretable code in the database so that once the database is created, all
  SQL and related code is part of the database and may be executed like this
  from the CLI:

  > `$ sqlite3 xyz.db "select sql from sql_notebook_cell where sql_notebook_cell_id = 'infoSchemaMarkdown'" | sqlite3 xyz.db`

  You can pass in arguments using .parameter or `sql_parameters` table, like:

  > `$ echo ".parameter set X Y; $(sqlite3 xyz.db \"SELECT sql FROM sql_notebook_cell where sql_notebook_cell_id = 'init'\")" | sqlite3 xyz.db`
- `sqlpage_files`: stores [SQLPage](https://sql.ophir.dev/) app server content
- `mime_type`: Stores MIME type information, including a ULID primary key and
  various attributes like name, description, file extension, timestamps, and
  user information.
- `device`: Stores device information, including a ULID primary key, device
  name, boundary, JSON-valid device elaboration, timestamps, and user
  information.
- `fs_content_walk_session`: Records file system content walk sessions,
  including ULID primary key, device ID, timestamps, maximum file I/O read
  bytes, regular expressions, JSON-valid elaboration, and user information.
  - `fs_content_walk_session` has a foreign key reference to the `device` table
    so that the same device can be used for multiple walk sessions but also the
    walk sessions can be merged across workstations for easier detection of
    changes and similaries between file systems on different devices.
- `fs_content_walk_path`: Stores file system content walk paths with a ULID
  primary key, walk session ID, root path, JSON-valid elaboration, timestamps,
  and user information.
  - Each walk path is associated with a walk session and one or more `root_path`
    entries.
  - It has a foreign key reference to the `fs_content_walk_session` table.
- `fs_content`: Records file system content information, including a ULID
  primary key, walk session ID, walk path ID, file details, JSON-valid
  attributes, timestamps, and user information.
  - On multiple executions, `fs_content` are inserted only if the the file
    content or `mtime` has changed
  - For historical logging, `fs_content` has foreign key references to both
    `fs_content_walk_session` and `fs_content_walk_path` tables to indicate
    which particular session and walk path the content was inserted for.
- `fs_content_walk_path_entry`: Contains entries related to file system content
  walk paths, including a ULID primary key, references to walk session, walk
  path, and content, file paths, and JSON-valid elaboration, timestamps, and
  user information.
  - On multiple executions, unlike `fs_content`, `fs_content_walk_path_entry`
    are always inserted and references the `fs_content`.`fs_content_id` of its
    related content. This method allows for a more efficient query of file
    version differences across sessions. With SQL queries, you can detect:
    - Which sessions have a file added or modified
    - Which sessions have a file deleted
    - What the differences are in file contents if they were modified across
      sessions.
  - `fs_content_walk_path_entry` has foreign key references to the
    `fs_content_walk_session`, `fs_content_walk_path`, and `fs_content` tables.

## Setup

- Ensure `sqlite3` is in PATH
- Download [sqlpkg](https://sqlpkg.org/) binaries

Get the SQLite extensions

```bash
$ eget nalgeon/sqlpkg-cli --file="sqlpkg"
$ sqlpkg install asg017/ulid
$ sqlpkg install nalgeon/fileio
$ sqlpkg install nalgeon/crypto
$ sqlpkg install asg017/path
$ sqlpkg install asg017/html     # https://github.com/asg017/sqlite-html/blob/main/docs.md
$ sqlpkg install asg017/http     # https://github.com/asg017/sqlite-http/blob/main/docs.md
$ sqlpkg install asg017/regex    # https://github.com/asg017/sqlite-regex/blob/main/docs.md
```

Other SQLite extensions to consider:

- `asg017/sqlite-md` - Markdown parser similar to asg017/html (at
  https://github.com/asg017/sqlite-md, not in SqlPkg yet, requested via ticket
  https://github.com/asg017/sqlite-md/issues/2)
- `x2bool/xlite` - Query Excel (.xlsx, .xls) and Open Document spreadsheets
  (.ods).
- `nalgeon/define` - User-defined functions and dynamic SQL.
- `daschr/cron` - Compares dates against cron patterns, whether they match or
  not.
- `jhowie/envfuncs` - Returns the value of the environment variable.
- `nalgeon/text` - String and text processing.
- `mergestat` - Query Git repos
  (https://docs.mergestat.com/mergestat-lite/usage/runtime-extension, not in
  SqlPkg yet, requested via ticket
  https://github.com/mergestat/mergestat/issues/1124)

## Testing

Scan the current directory for all files and store them into
`device-content.sqlite.db` (this is idempotent, by default it ignores `.git` and
`node_modules` directories):

```bash
$ ./cactl.ts
```

See the contents with [SQLpage](https://github.com/lovasoa/SQLpage):

```bash
eget lovasoa/SQLpage   # if you don't already have it downloaded
DATABASE_URL=sqlite://./device-content.sqlite.db sqlpage.bin
```

Show the information schema as markdown:

```bash
$ ./cactl.ts sql fsContentWalkSessionStats infoSchemaMarkdown | sqlite3 device-content.sqlite.db
$ sqlite3 device-content.sqlite.db "select sql from sql_notebook_cell where sql_notebook_cell_id = 'infoSchemaMarkdown'" | sqlite3 device-content.sqlite.db
```

Show the stats:

```bash
$ ./cactl.ts sql fsContentWalkSessionStats | sqlite3 device-content.sqlite.db --table
$ sqlite3 device-content.sqlite.db "select sql from sql_notebook_cell where sql_notebook_cell_id = 'fsContentWalkSessionStats'" | sqlite3 device-content.sqlite.db --table
```

Show all the HTML anchors in all HTML files:

```bash
$ ./cactl.ts sql allHtmlAnchors | sqlite3 device-content.sqlite.db --json
$ sqlite3 device-content.sqlite.db "select sql from sql_notebook_cell where sql_notebook_cell_id = 'allHtmlAnchors'" | sqlite3 device-content.sqlite.db --json
```

## Tasks

- [ ] Add args/option for running ./cactl.ts with a starting root path(s)
- [ ] Add Deno-based Unit Tests with TAP output or this ancient
      [SQLite TAP extension](https://github.com/yanick/SQLiteTap)
- [ ] Add SQL in notebook to easily remove and vacuum all sessions, walk paths,
      and walk entries prior to a given date.
  - [ ] Add SQL in notebook to easily remove all sessions, walk paths, and walk
        entries except the ones referenced by the most recent session.
- [ ] Add SQL in notebook to report on the differences between sessions (files
      added, modified, removed)
- [ ] Figure out to properly test that symlinks work (smoke testing seems to
      indicate that they do)
- [ ] Figure out what to do when fileio_read cannot read larger than
      1,000,000,000 bytes for hash, etc.
- [ ] Add one or more SQLPage pages that will contain PlantUML or database
      description markdown so that the documentation for the database is
      contained within the DB itself.
- [ ] Learn from
      [Scraping JSON, HTML, and ZIP Files with Pure SQLite](https://observablehq.com/@asg017/scrape-json-html-zip-with-sqlite)
- [ ] See [simon987/sist2](https://github.com/simon987/sist2) for other ideas
      like:
  - [ ] Extracts text and metadata from
        [common file types](https://github.com/simon987/sist2#format-support)
  - [ ] [Generates thumbnails](https://github.com/simon987/sist2#format-support)
  - [ ] Manual tagging from the UI and automatic tagging based on file
        attributes via
        [user scripts](https://github.com/simon987/sist2/blob/master/docs/scripting.md)
  - [ ] Recursive scan inside
        [archive files](https://github.com/simon987/sist2#archive-files) using
        [SQLite Zip File support](https://sqlite.org/zipfile.html)
  - [ ] [Named-entity recognition](https://github.com/simon987/sist2#NER)

## ULID Primary Keys across multiple devices

The ULID (Universally Unique Lexicographically Sortable Identifier) is designed
to generate unique identifiers across distributed systems without coordination.
Let's break down its structure to understand the likelihood of conflicts.

A ULID consists of:

1. A 48-bit timestamp, which gives millisecond precision for about 138 years.
2. A 80-bit random component, which is generated randomly for each ID.

Given the design, there are two primary scenarios where a conflict might arise:

1. **Timestamp Collision**: If two or more ULIDs are generated at the exact same
   millisecond on different machines, then the uniqueness of the ULID is purely
   dependent on the randomness of the second component.
2. **Randomness Collision**: Even if the timestamp differs, if the random
   component generated is the same for two ULIDs (which is astronomically
   unlikely), there will be a conflict.

Now, let's consider the probability of each scenario:

1. **Timestamp Collision**: If you're generating millions of ULIDs in a short
   span of time, it's quite likely that you'll have multiple ULIDs with the same
   timestamp. This isn't a problem by itself, but it means the uniqueness then
   rests on the random component.
2. **Randomness Collision**: The random component of a ULID is 80 bits. This
   means there are \(2^{80}\) or approximately \(1.2 x 10^{24}\) possible
   values. If you generate millions (let's say one million for simplicity), the
   chance of any two having the same random value is tiny. Using the birthday
   paradox as a rough estimation, even after generating billions of ULIDs, the
   probability of a conflict in the random component remains astronomically low.

If you generate millions of ULIDs across multiple machines, the chances of a
collision are extremely low due to the large randomness space of the 80-bit
random component. The design of the ULID ensures that even in high-throughput
distributed systems, conflicts should be virtually non-existent. As always with
such systems, monitoring and conflict resolution strategies are still good
practices, but the inherent risks are minimal.