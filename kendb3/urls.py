"""
URL configuration for kendb3 project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('api/v0/', include('profiles.urls')),
    path('api/v0/', include('submissions.urls')),
    path('admin/', admin.site.urls),
]
