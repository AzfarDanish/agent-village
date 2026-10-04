# Packaging, distribution & versioning

## How people get it: git clone

```sh
git clone https://github.com/azfardanish/agent-village.git
cd agent-village
sh start.sh
```

Deliberately boring: there is nothing to build (stdlib backend, no
bundler), nothing to install (no dependencies), and the engines stay the
user's own installs so auth never gets repackaged. A package manager entry
or release tarball would add a distribution to maintain without removing
any step — clone *is* the install.

## No container image

Also deliberate. Inside a container the village would need the host's
engine CLIs, their auth state, and the user's project folders bind-mounted
with matching UIDs — i.e. re-exposing everything the local-only design
keeps simple. If you containerize it yourself: mount the project dirs,
mount the engine binaries + their config/auth homes read-write, pass
through the credential environment, and keep publishing the port on
loopback. Unsupported, but the pieces are exactly the [config](configuration.md)
and [engines](engines.md) surfaces.

## Versioning

`0.x.y` SemVer while pre-1.0: `x` for behavior/config changes, `y` for
fixes. The config schema has its own version (`config.py:CONFIG_VERSION`,
currently 1) with loud rejection on mismatch — config and app version
independently.

## Changelog

`CHANGELOG.md` follows Keep a Changelog (`Added/Changed/Fixed`, plus
`Unreleased` at top). Every behavior, config, or contract change lands
with a changelog entry in the same PR. The `## Conversation decisions`
trail from early development is preserved at the bottom as history, not
maintained going forward.
