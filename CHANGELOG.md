# Change Log

All notable changes to the "link-checker" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 1.0.0

Initial release of Link Checker.

## 1.1.1

* Now only checks links that begin with http:// and https://
* Checked links are now tracked and won't be rechecked every save.

## 1.2.0

* Now consults `rstspec.toml` for role resolution and validates links using `:roles:`.
  It pulls role information from the latest **release**.
* Roles resolved with an extra slash will be reported in warnings.

## 1.3.0

* Fetches intersphinx files from `snooty.toml` and checks refs. Local ref checking
  is not supported at this time.
* Checks constants that represent urls Initial release
