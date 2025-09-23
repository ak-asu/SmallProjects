
import os
from dotenv import load_dotenv


load_dotenv()

MODEL = os.getenv("LC_MODEL", "gemini-2.5-flash")

TZ = os.getenv("TZ", "UTC")
