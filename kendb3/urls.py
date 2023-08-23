from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('', include('profiles.urls')),
    path('', include('submissions.urls')),
    path('api/v0/get/', include('api_lib.urls')),
    path('admin/', admin.site.urls),
]
