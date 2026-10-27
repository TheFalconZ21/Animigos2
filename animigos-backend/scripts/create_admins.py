import os
import sys
import django

# Setup Django environment
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import Profile

ADMIN_USERS = [
    {
        'email': 'J.carmonao@udd.cl',
        'username': 'jcarmonao',
        'display_name': 'J. Carmona',
        'password': 'villarroel123',
    },
    {
        'email': 'agustingarridop@gmail.com',
        'username': 'agustingarridop',
        'display_name': 'Agustín Garrido',
        'password': 'villarroel123',
    },
    {
        'email': 'mfalcong@udd.cl',
        'username': 'mfalcong',
        'display_name': 'M. Falcón',
        'password': 'villarroel123',
    },
    {
        'email': 'alonsorogonz@gmail.com',
        'username': 'alonsorogonz',
        'display_name': 'Alonso González',
        'password': 'villarroel123',
    },
]

def create_or_update_admins():
    print("=== Configuración de Usuarios Administradores de Animigos ===")
    for admin_data in ADMIN_USERS:
        email = admin_data['email']
        username = admin_data['username']
        display_name = admin_data['display_name']
        password = admin_data['password']

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.filter(username__iexact=username).first()

        if user:
            user.username = username
            user.email = email
            user.is_staff = True
            user.is_superuser = True
            user.set_password(password)
            user.save()
            print(f"[OK] [ACTUALIZADO] {email} | username: {username} | is_staff: True | is_superuser: True")
        else:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                is_staff=True,
                is_superuser=True
            )
            print(f"[OK] [CREADO] {email} | username: {username} | is_staff: True | is_superuser: True")

        profile, _ = Profile.objects.get_or_create(user=user)
        profile.display_name = display_name
        profile.save()

    print("\nTodos los 4 administradores fueron configurados con éxito.")

if __name__ == '__main__':
    create_or_update_admins()
