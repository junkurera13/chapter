# Sourced helper for Cloud Agent shells.
#
# The Cursor agent runtime prepends its own directory (containing a Node 22
# binary) to PATH on every command, which shadows nvm. This project pins
# Node 24 (see package.json "engines"), so we install it if needed and place
# its bin directory ahead of the runtime's node for the current process.
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh" >/dev/null 2>&1
# Idempotent: a no-op when Node 24 is already present (e.g. from a snapshot).
nvm install 24 >/dev/null 2>&1 || true
nvm use 24 >/dev/null 2>&1 || true
export PATH="$(dirname "$(nvm which 24)"):$PATH"
