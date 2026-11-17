from django.db import migrations
from django.contrib.auth.hashers import make_password

ADMINS_TO_SEED = [
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

def seed_admins(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Profile = apps.get_model('users', 'Profile')

    for admin in ADMINS_TO_SEED:
        email = admin['email']
        username = admin['username']
        display_name = admin['display_name']
        hashed_pw = make_password(admin['password'])

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            user = User.objects.filter(username__iexact=username).first()

        if user:
            user.username = username
            user.email = email
            user.password = hashed_pw
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.save()
        else:
            user = User.objects.create(
                username=username,
                email=email,
                password=hashed_pw,
                is_staff=True,
                is_superuser=True,
                is_active=True
            )

        profile, _ = Profile.objects.get_or_create(
            user=user,
            defaults={'display_name': display_name}
        )
        if profile.display_name != display_name:
            profile.display_name = display_name
            profile.save()

def unseed_admins(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_alter_useranimeentry_status'),
    ]

    operations = [
        migrations.RunPython(seed_admins, reverse_code=unseed_admins),
    ]
