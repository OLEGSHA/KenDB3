from django.urls import path

from . import views

urlpatterns = [
    path('submissions/', views.submissions),
    path('submissions/<int:submission_id>', views.submission_by_sid),
    path('submissions/revisions/', views.revisions),
    path('submissions/revisions/<int:revision_id>', views.revision_by_id),
    path('submissions/<int:submission_id>/v<str:revision_string>',
         views.revision_of_submission),
]
