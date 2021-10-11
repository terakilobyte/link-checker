# link-checker

This extension checks links in `.md`, `.txt`, and `.rst` files for their
status and for repository freshness.

## Features

Automatically check links for their response code, and in the case of Github repositories, their freshness. Created for authoring docs at MongoDB, it will
also check links in `:roles:` using the latest **release**.

![link-checking](images/link-checking.png)

## Requirements

This extension requires a [Github Developer API Key](https://github.com/settings/tokens).
Once you have an API key with full **repos** permissions, set your `link-checker.linkCheckerToken` setting with your API key.

## Extension Settings

## Known Issues

Doens't link to specific file location of local ref declarations.

**Enjoy!**
