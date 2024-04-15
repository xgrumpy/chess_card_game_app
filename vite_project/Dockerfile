FROM node:18-alpine AS build
# Create app directory
WORKDIR /usr/src/app
# Copy Node Project in
COPY . .
# Install yarn, Vite, and build project
#RUN npm install --global yarn 
RUN npm install --global vite@4.5.0 &&\
    yarn install && \
    yarn build 

FROM nginx:alpine3.18
WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY --from=build /usr/src/app/dist .
RUN mv index.html play.html
COPY home/index.html ./index.html
ENTRYPOINT ["nginx", "-g", "daemon off;"]
