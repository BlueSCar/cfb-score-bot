FROM node:10-alpine

RUN mkdir -p /home/node/cfb-score-bot/node_modules && chown -R node:node /home/node/cfb-score-bot

WORKDIR /home/node/cfb-score-bot

COPY package*.json ./

RUN npm install pm2 -g
RUN npm install

COPY . .
COPY --chown=node:node . .

USER node

CMD [ "pm2-runtime", "index.js" ]
