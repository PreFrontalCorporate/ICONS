const { contextBridge } = require('electron');
const jwt   = require('jsonwebtoken');
const fs    = require('fs');
const path  = require('path');

const secret = fs.readFileSync(
  path.join(__dirname, 'jwt_secret.pem'),
  'utf8'
);

contextBridge.exposeInMainWorld('api', {
  verifyJWT: (token: string) => jwt.verify(token, secret)
});
