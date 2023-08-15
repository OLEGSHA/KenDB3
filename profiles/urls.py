from django.urls import path

from . import views

urlpatterns = [
    path('api/v0/profiles/', views.profiles),
]
