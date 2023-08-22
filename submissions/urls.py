from django.urls import path

from . import views
from . import models
from api_lib import api_server

urlpatterns = [
    path('submissions/', views.page),
    path('submissions/<path:subpath>', views.page),
] + [
     path(f"api/v0/{model._api.api_name}",
          api_server.serve_data_manager,
          {'model_class': model})
     for model in [
          models.Submission,
          models.SubmissionRevision
     ]
]
