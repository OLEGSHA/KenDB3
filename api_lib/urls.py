from django.urls import path

from . import api_server

urlpatterns = [
    path('<str:model_name>', api_server.serve_data_manager,
         name='dataman-endpoint')
]
