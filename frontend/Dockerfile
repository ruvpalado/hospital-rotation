FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Build the app ONCE at image-build time (not at container startup). This is
# more robust than building on every container start: build failures surface
# in the deploy/build logs instead of crash-looping the running service, and
# the container doesn't risk running out of memory doing a react-scripts build
# at runtime. CI=false so eslint warnings don't fail the build (Railway sets
# CI=true by default, which would otherwise turn warnings into build errors).
ENV CI=false
# GENERATE_SOURCEMAP=false cuts build memory + time substantially (source maps
# aren't needed for the deployed bundle) -- avoids OOM on constrained builders.
ENV GENERATE_SOURCEMAP=false
# serve listens on $PORT (Railway injects PORT=8080). EXPOSE must match the
# port the app actually binds, because Railway derives the public domain's
# target port from EXPOSE when it isn't overridden -- a mismatch here routes
# the domain to a dead port and returns 502.
RUN npm run build
EXPOSE 8080
# The container now only serves the pre-built static files.
CMD ["npm", "start"]
