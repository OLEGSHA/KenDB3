from django.contrib import admin
from django.urls import include, path
from django.views.generic.base import RedirectView

urlpatterns = [
    path('', include('profiles.urls')),
    path('', include('submissions.urls')),
    path('', RedirectView.as_view(url='/submissions/')),
    path('api/v0/get/', include('api_lib.urls')),
    path('admin/', admin.site.urls),
]
