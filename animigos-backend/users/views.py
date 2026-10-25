from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from .serializers import (
    ProfileSerializer,
    UserPreferencesSerializer,
    UserRegistrationSerializer
)

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    Registra una nueva cuenta de usuario y crea automáticamente su perfil y preferencias.
    """
    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        login(request, user)
        profile_serializer = ProfileSerializer(user.profile)
        return Response({
            'message': 'Usuario registrado exitosamente',
            'user': profile_serializer.data
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_user(request):
    """
    Inicia sesión con credenciales de usuario.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Usuario y contraseña requeridos'}, status=status.HTTP_400_BAD_REQUEST)

    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
        profile_serializer = ProfileSerializer(user.profile)
        return Response({
            'message': 'Sesión iniciada correctamente',
            'user': profile_serializer.data
        }, status=status.HTTP_200_OK)
    
    return Response({'error': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_user(request):
    logout(request)
    return Response({'message': 'Sesión cerrada correctamente'})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    """
    Retorna el perfil del usuario actual (o demo si no está autenticado).
    """
    if request.user.is_authenticated:
        return Response(ProfileSerializer(request.user.profile).data)
    
    # Si no está logueado, retornar perfil anfitrión demo
    first_user = User.objects.first()
    if first_user and hasattr(first_user, 'profile'):
        return Response(ProfileSerializer(first_user.profile).data)

    return Response({'authenticated': False, 'message': 'No hay sesión activa'})


@api_view(['PATCH'])
@permission_classes([AllowAny])
def update_profile(request):
    """
    Actualiza datos de perfil (nombre, avatar, bio, anime favorito).
    """
    user = request.user if request.user.is_authenticated else User.objects.first()
    if not user or not hasattr(user, 'profile'):
        return Response({'error': 'No se encontró perfil para actualizar'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProfileSerializer(user.profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([AllowAny])
def update_preferences(request):
    """
    Actualiza preferencias del usuario para el recomendador (géneros favoritos, vetos, experiencia).
    """
    user = request.user if request.user.is_authenticated else User.objects.first()
    if not user or not hasattr(user, 'profile') or not hasattr(user.profile, 'preferences'):
        return Response({'error': 'No se encontraron preferencias para actualizar'}, status=status.HTTP_404_NOT_FOUND)

    serializer = UserPreferencesSerializer(user.profile.preferences, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
