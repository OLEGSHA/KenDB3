from django.urls import path

from . import views

urlpatterns = [
    path('submissions/',
         views.page),

    path('submissions/<path:subpath>',
         views.page),

    path('api/v0/submissions/',
         views.submissions),

    path('api/v0/submissions/<int:submission_id>',
         views.submission_by_sid),

    path('api/v0/submissions/revisions/',
         views.revisions),

    path('api/v0/submissions/revisions/<int:revision_id>',
         views.revision_by_id),

    path('api/v0/submissions/<int:submission_id>/v<str:revision_string>',
         views.revision_of_submission),
]
