from django.urls import path

from . import views

urlpatterns = [
    path('submissions/', views.page),
    path('submissions/<path:subpath>', views.page),
]
