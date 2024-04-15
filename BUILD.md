# Build Documentation

## Building for debug and running locally:
```
cd Server
dotnet restore
doctnet run
```

```
cd vite_porject
npm install vite
yarn install
yarn dev
```

## Building containers in Docker
```
cd Server
docker build -f ./Dockerfile -t chewker-server .

cd vite_porject
docker build -f ./Dockerfile -t chewker-client .
```
## Running containers in Docker
```
docker run -p 9090:9090 -v C:/Projects/Chewker-Main/data:/data -d --rm --name chewker-server chewker-server 
docker run -p 3000:80 -d --rm --name chewker-client chewker-client
```
## Using Docker Compose
The data or db is saved to the data directory in the docker-compose directory/

cd docker-compose

### Get Certificate
docker compose -f ./docker-compose.certbot.yaml up
After running ctrl+c then

docker compose -f ./docker-compose.certbot.yaml down


## Using Docker Compose
The data or db is saved to the data directory in the docker-compose directory/

cd docker-compose

### Build
docker compose build

### Run
docker compose up -d

### Stop
docker compose down 