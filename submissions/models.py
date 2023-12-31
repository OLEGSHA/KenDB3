"""Submissions, submission revisions and Minecraft versions."""

from django.db import models
from django.core.validators import URLValidator

from taggit.managers import TaggableManager

from api_lib.api_fields import api_model, APIEngine


URL_MAX_LENGTH = 256
URL_VALIDATOR = URLValidator(schemes=['http', 'https'])


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
        help_text=('Displayed user-friendly name like <code>JE 1.19.4</code>. '
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

    submission_id = models.PositiveIntegerField(
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

    @_api().property
    def latest_revision(self):
        """ID of the lastest revision of this submission or None."""
        rev = self.get_latest_revision(raise_if_none=False)
        return rev.id if rev else None

    last_modified = models.DateTimeField(
        help_text=('Last modification timestamp.'),
        auto_now=True,
    )

    def __str__(self):
        latest = self.get_latest_revision(raise_if_none=False)
        if latest:
            if latest.name:
                max_length = 25
                if len(latest.name) >= max_length:
                    name = latest.name[:max_length] + '\u2026' # ellipsis
                else:
                    name = latest.name
                name = repr(name)
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

    authors: _api('*', 'basic') = models.ManyToManyField(
        help_text=('Users that should be credited as map authors.'),
        to='profiles.Profile',
        related_name='authored_revisions',
        blank=False,
    )

    playtesters: _api('*') = models.ManyToManyField(
        help_text=('Users that should be credited as playtesters.'),
        to='profiles.Profile',
        related_name='playtested_revisions',
        blank=True,
    )

    submitted_by: _api() = models.ForeignKey(
        help_text=('User that submitted this revision.'),
        to='profiles.Profile',
        on_delete=models.PROTECT,
        related_name='submitted_revisions',
        blank=False,
    )

    submitted_at: _api() = models.DateTimeField(
        help_text=('Timestamp of the submission message.'),
        blank=False,
    )

    added_at: _api() = models.DateTimeField(
        help_text=('First time the revision was added to the database.'),
        auto_now_add=True,
        blank=False,
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

    tags: _api('*', 'basic') = TaggableManager(
        help_text=('A comma-separated list of tags like '
                   '<code>retracted</code> or <code>custom-mechanics</code>.'),
    )

    download_url: _api() = models.CharField(
        help_text=('Download URL starting with <code>http[s]://</code> or '
                   'a human-readable explanation. '
                   'HTML will be retained for non-URL values.'),
        max_length=URL_MAX_LENGTH,
        blank=False,
    )

    demo_url: _api() = models.URLField(
        help_text=('Video URL of a demo or trailer starting with '
                   '<code>http[s]://</code>. '
                   'Blank if none available.'),
        max_length=URL_MAX_LENGTH,
        validators=[URL_VALIDATOR],
        blank=True,
    )

    intended_solution_url: _api() = models.CharField(
        help_text=('Video URL of the intended solution starting with '
                   '<code>http[s]://</code> or '
                   'a human-readable explanation. '
                   'Blank if none available. '
                   'HTML will be retained for non-URL values.'),
        max_length=URL_MAX_LENGTH,
        blank=True,
    )

    rules: _api() = models.JSONField(
        help_text=('Rules, permissions and other important remarks players '
                   'should read before playing. '
                   '[Format to be decided].'),  # TODO
        blank=True,
    )

    author_notes: _api() = models.TextField(
        help_text=('Less important notes interested players may want to read.'
                   'Unsanitized HTML-disabled Markdown.'),
        blank=True,
    )

    changelog: _api() = models.TextField(
        help_text=('Summary of changes in this revision. '
                   'Unsanitized HTML-disabled Markdown.'),
        blank=True,
    )

    editors_comment: _api() = models.TextField(
        help_text=("Database editors' comments on the submission. "
                   'Unsanitized HTML-disabled Markdown.'),
        blank=True,
    )

    _api.add_related('appearances', ['*', 'basic'])

    last_modified = models.DateTimeField(
        help_text=('Last modification timestamp.'),
        auto_now=True,
    )

    def __str__(self):
        return f"{self.revision_of} v{self.revision_string}"


@api_model
class Appearance(models.Model):
    """Mention of a submission in a video or similar."""

    _api = APIEngine()

    url: _api('*') = models.CharField(
        help_text=('Mention URL starting with <code>http[s]://</code> or '
                   'a human-readable explanation. '
                   'HTML will be retained for non-URL values.'),
        max_length=URL_MAX_LENGTH,
        blank=False,
    )

    revision: _api('*', 'search') = models.ForeignKey(
        help_text=('Submission revision that appears in the material.'),
        to=SubmissionRevision,
        on_delete=models.CASCADE,
        related_name='appearances',
    )

    added_at: _api('*') = models.DateTimeField(
        help_text=('First time the appearance was added to the database.'),
        auto_now_add=True,
        blank=False,
    )

    authors: _api('*', 'search') = models.ManyToManyField(
        help_text=('Users that should be credited as appearance authors.'),
        to='profiles.Profile',
        related_name='authored_appearances',
        blank=False,
    )

    submitted_by: _api('*') = models.ForeignKey(
        help_text=('User that submitted this appearance.'),
        to='profiles.Profile',
        on_delete=models.PROTECT,
        related_name='submitted_appearances',
        blank=False,
    )

    submission_method: _api('*') = models.TextField(
        help_text=('Human-readable description of submission method, '
                   'e.g. link to submission message. ',
                   'Unsanitized HTML-disabled Markdown.'),
        blank=False,
    )

    class Role(models.TextChoices):
        CHEESE = 'chs', 'Cheese'
        SOLUTION = 'sln', 'Solution'
        INCOMPLETE = 'inc', 'Incomplete'
        REVIEW = 'rvw', 'Review'
        OTHER = 'etc', 'Other'

    role: _api('*', 'search') = models.CharField(
        help_text=('Role of this appearance as intended.'),
        max_length=3,
        choices=Role.choices,
        default=Role.CHEESE,
        blank=False,
    )

    class Validity(models.TextChoices):
        """Validation state of a cheese, solution, or review.

        NO_CONTEST  validity has not been questioned, assumed valid
        CONTESTED   there is an ongoing or unresolved conflict
        VALID       conflict settled as valid by parties or by editors
        INVALID     editors believe entry is not valid when not retracted
        RETRACTED   author issued a retraction, assumed invalid
        NOT_APPLICABLE (None)  entry does not require validation
        """
        NO_CONTEST = 'noc', 'Not contested'
        CONTESTED = 'cnt', 'Contested'
        VALID = 'vld', 'Confirmed valid'
        INVALID = 'inv', 'Invalid'
        RETRACTED = 'rtr', 'Retracted'
        NOT_APPLICABLE = '', 'N/A'

    validity: _api('*', 'search') = models.CharField(
        help_text=('Validation state of this appearance '
                  'or blank if not applicable.'),
        max_length=3,
        choices=Validity.choices,
        default=None,
        blank=True,
    )

    author_notes: _api('*') = models.TextField(
        help_text=('Brief author notes. '
                   'Unsanitized HTML-disabled Markdown.'),
        blank=True,
    )

    editors_comment: _api('*') = models.TextField(
        help_text=("Database editors' comments. "
                   'Unsanitized HTML-disabled Markdown.'),
        blank=True,
    )

    last_modified = models.DateTimeField(
        help_text=('Last modification timestamp.'),
        auto_now=True,
    )

    def __str__(self):
        return f"{self.get_role_display()} #{self.pk} of {self.revision}"
