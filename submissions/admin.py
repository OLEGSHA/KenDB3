from django.contrib import admin

from .models import Submission, SubmissionRevision, MinecraftVersion


admin.site.register(Submission)
admin.site.register(SubmissionRevision)
admin.site.register(MinecraftVersion)
