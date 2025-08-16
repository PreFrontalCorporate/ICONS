whoami
# make sure you're the normal 'icon' user, NOT root
whoami          # should print: icon
# remove the half-written folder that belongs to root
sudo rm -rf /home/icon/.vscode-server-insiders
# ensure your whole home dir is owned by you
sudo chown -R icon:icon /home/icon
# (replace both icon strings if your Linux username is different)
# verify the folder is now gone / writable
ls -ld /home/icon        # owner should be icon
# relaunch VS Code Insiders (this will re-download the server once)
code-insiders .
clear
cd /home/icon
pnpm dev -F web        # starts the PWA at http://localhost:3000
pnpm dev -F extension  # builds & watches the MV3 add-on
pnpm dev -F desktop    # launches the Electron overlay
cclear
ps aux | grep pnpmps aux | grep pnpm
ps aux | grep node
ps aux | grep node
ps aux | grep node
clear
apt update
