import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'some_random_secret'
    NEBIUS_API_KEY = os.environ.get('NEBIUS_API_KEY')  # or store in .env
