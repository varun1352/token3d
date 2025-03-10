from flask import Flask
from config import Config
from dotenv import load_dotenv
import os

load_dotenv()  # This loads the variables from .env into os.environ

HF_TOKEN = os.environ.get("HF_TOKEN")

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from app.routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app
