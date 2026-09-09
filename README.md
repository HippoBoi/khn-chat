# KHN Chat
This project is a simple chat application that is being developed over time.
Currently uses Capacitor so it works natively for mobile.

This repo includes both frontend and backend so it was easier to manage (I'm regretting this a little bit but it's pretty workable)
Some bad organization lead me to use Docker only for running the PostgreSQL database instead of the whole project. This is something I have to work on later on.

# Running the project
## Web App
> npm install

> npm run dev

## Backend
> npm install

> npm start

Note: you must be running the database already or the backend will fail.

## Mobile App
> npm run cap:deploy

Note: this is just a command that runs other commands. Sorry for not going into much detail about that. You can check package.json on the react-chat folder to see what it does in the background

this project is a lesson to just use laravel instead
