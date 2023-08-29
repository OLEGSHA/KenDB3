from django.contrib import admin

from .models import (
    Submission,
    SubmissionRevision,
    MinecraftVersion,
    Appearance,
)


admin.site.register(Submission)
admin.site.register(SubmissionRevision)
admin.site.register(MinecraftVersion)
admin.site.register(Appearance)
