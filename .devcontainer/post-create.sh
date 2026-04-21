#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

script_dir="$(realpath "$(dirname "${BASH_SOURCE[0]}")")"

# Execute custom post-create script
if [ -f "$script_dir/post-create-custom.sh" ]; then
	# shellcheck disable=SC1091
	. "$script_dir/post-create-custom.sh"
fi

# Install Node.js version specified in .nvmrc
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install \
	--alias=project
nvm use

# Install pnpm
package_manager=$(npm info ./ packageManager)
npm install \
	--global \
	"$package_manager"

# Install pnpm dependencies
pnpm install
