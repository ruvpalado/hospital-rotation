FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# CI=false so Create React App does NOT treat eslint warnings as build errors.
# Railway (and most CI) set CI=true by default, which would fail the
# `react-scripts build` on any lint warning and leave the service with no
# build to serve (Railway then returns 502 "Application failed to respond").
ENV CI=false
EXPOSE 3000
CMD ["npm", "start"]
