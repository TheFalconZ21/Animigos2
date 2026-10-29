#!/usr/bin/env bash
# Exit on error
set -o errexit

pip install -r requirements.txt
python manage.py migrate
python manage.py load_anime_bulk
python manage.py seed_initial_data
