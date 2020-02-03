# link-checker

This extension checks links in `.md`, `.txt`, and `.rst` files for their
status and for repository freshness.

## Features

Automatically check links for their response code, and in the case of Github repositories, their freshness.

![link-checking](images/link-checking.png)

## Requirements

This extension requires a [Github Developer API Key](https://github.com/settings/tokens).
Once you have an API key with full **repos** permissions,
define an environmental variable called `LINK_CHECKER_TOKEN`.

For example, if you use `zsh`:

```sh
echo "LINK_CHECKER_TOKEN=<API Key>" >> ~/.zshrc
```

## Extension Settings

## Known Issues

## Release Notes

### 1.0.0

Initial release of Link Checker.

**Enjoy!**
