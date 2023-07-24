"""Submissions, submission revisions and Minecraft versions."""

from django.db import models

from api_lib.api_fields import api_model, APIEngine


@api_model
class MinecraftVersion(models.Model):
    """A Minecraft version."""

    _api = APIEngine()

    comparator: _api() = models.IntegerField(
        help_text=('Version number that can be used to compare versions.'),
    )

    family: _api() = models.SmallIntegerField(
        help_text=('Family of versions comparable by '
                   '<code>comparator</code>.'),
        choices=[
            (1, 'JE'),
            (2, 'BE'),
            (3, 'Other'),
        ],
        blank=False,
        default=1,
    )

    display_name: _api() = models.CharField(
        help_text=('Displayed user-friendly name like <code>JE 1.19.4</code>.'
                   'Plain text, HTML will be escaped.'),
        max_length=32,
        blank=False,
    )

    is_common: _api() = models.BooleanField(
        help_text=('True when this version is well-known and likely to fil'
                   'tered against.'),
        default=False,
    )

    def can_compare_to(self, other):
        """Check whether it makes sense to compare this object to `other`.

        If this check succeeds, __le__ and __eq__ will return valid results.
        """

        return isinstance(other, type(self)) and self.family == other.family

    def __le__(self, other):
        if not isinstance(other, type(self)):
            return NotImplemented
        if self.family != other.family:
            raise ValueError('Attempted to compare versions of different '
                             f"families: {self} and {other}.")
        return self.comparator < other.comparator

    def __eq__(self, other):
        if not isinstance(other, type(self)):
            return NotImplemented
        if self.family != other.family:
            raise ValueError('Attempted to compare versions of different '
                             f"families: {self} and {other}.")
        return self.comparator == other.comparator

    def __str__(self):
        return f"Minecraft version {self.display_name}"


@api_model
class Submission(models.Model):
    """Submission model.

    Most fields describing the submission are part of a SubmissionVersion.
    """

    _api = APIEngine()

    submission_id = models.SmallIntegerField(
        help_text=('Submission ID shown to visitors.'),
        primary_key=True,  # therefore, not using _api()
    )

    _api.add_related('revisions')

    def get_latest_revision(self, *, raise_if_none=True):
        """Fetch the latest revision of this submission.

        For submissions with no revisions, if raise_if_none is not False, raise
        a ValueError; return None otherwise.
        """
        rev_or_none = max(self.revisions.all(),
                          key=lambda r: r.submitted_at,
                          default=None)
        if rev_or_none is None and raise_if_none:
            raise ValueError('No revisions found for submission '
                             f"#{self.submission_id}")
        return rev_or_none

    def __str__(self):
        latest = self.get_latest_revision(raise_if_none=False)
        if latest:
            if latest.name:
                name = repr(latest.name)
            else:
                name = 'Untitled'
        else:
            name = '<no revisions>'

        return f"#{self.submission_id} {name}"


@api_model
class SubmissionRevision(models.Model):
    """Revision of a submission."""

    _api = APIEngine()

    revision_of: _api('*', 'basic') = models.ForeignKey(
        help_text=('Submission this object is a revision of.'),
        to=Submission,
        on_delete=models.CASCADE,
        related_name='revisions',
    )

    name: _api('*', 'basic') = models.CharField(
        help_text=('Display name for the submission. Blank for untitled. '
                   'Plain text, HTML will be escaped.'),
        max_length=256,
        blank=True,
    )

    revision_string: _api('*', 'basic') = models.CharField(
        help_text=('Version string, e.g. <code>1.0.3</code>. '
                   'Plain text, HTML will be escaped.'),
        max_length=16,
        blank=False,
    )

    #authors: _api('*', 'basic')  # TODO
    #playtesters: _api()  # TODO

    submitted_by: _api() = models.ForeignKey(
        help_text=('User that submitted this revision.'),
        to='profiles.Profile',
        on_delete=models.PROTECT,
    )

    submitted_at: _api() = models.DateTimeField(
        help_text=('Timestamp of the submission message.'),
    )

    added_at: _api() = models.DateTimeField(
        help_text=('First time the revision was added to the database.'),
        auto_now_add=True,
    )

    minecraft_version_max: _api('*', 'basic') = models.ForeignKey(
        help_text=('Newest Minecraft version supported. '
                   'Must be comparable with, and greater than or equal to '
                   '<code>minecraft_version_min</code>.'),
        to=MinecraftVersion,
        on_delete=models.PROTECT,
        db_index=False,
        related_name='+',
    )

    minecraft_version_min: _api('*', 'basic') = models.ForeignKey(
        help_text=('Oldest Minecraft version supported. '
                   'Must be comparable with, and less than or equal to '
                   '<code>minecraft_version_max</code>.'),
        to=MinecraftVersion,
        on_delete=models.PROTECT,
        db_index=False,
        related_name='+',
    )

    #tags: _api('*', 'basic') = TagManager  # TODO

    download_url: _api() = models.CharField(
        help_text=('Download URL starting with <code>http[s]://</code> or '
                   'a human-readable explanation. '
                   'HTML will be retained for non-URL values.'),
        max_length=256,
        blank=False,
    )

    intended_solution_url: _api() = models.CharField(
        help_text=('Video URL of the intended solution starting with '
                   '<code>http[s]://</code> or '
                   'a human-readable explanation. '
                   'Blank if none available. '
                   'HTML will be retained for non-URL values.'),
        max_length=256,
        blank=True,
    )

    rules: _api() = models.JSONField(
        help_text=('Rules, permissions and other important remarks players '
                   'should read before playing. '
                   '[Format to be decided].'),  # TODO
    )

    author_notes: _api() = models.TextField(
        help_text=('Less important notes interested players may want to read.'
                   'Unsanitized HTML-disabled Markdown.'),
    )

    changelog: _api() = models.TextField(
        help_text=('Summary of changes in this revision.'
                   'Unsanitized HTML-disabled Markdown.'),
    )

    editors_comment: _api() = models.TextField(
        help_text=("Database editors' comments on the submission."
                   'Unsanitized HTML-disabled Markdown.'),
    )

    def __str__(self):
        return f"{self.revision_of} v{self.revision_string}"
