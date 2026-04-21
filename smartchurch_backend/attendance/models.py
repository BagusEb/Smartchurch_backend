from django.db import models
from django.contrib.auth.models import User
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

# ================= TABEL ROLE USER =================
class UserProfile(models.Model):
    # Sesuai dengan spesifikasi dokumen Capstone Form 2
    ROLE_CHOICES = (
        ('admin', 'Admin / Church Committee'),
        ('leader', 'Church Leader (Pastor)'),
    )
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='admin')

    class Meta:
        db_table = 't_user_role'
        
    def __str__(self):
        return f"{self.user.username} - {self.role}"
    

# Otomatis membuatkan Profile kosong tiap kali kamu bikin akun User baru
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()


# ==========================================
# 1. PROFIL & MASTER DATA
# ==========================================

class Member(models.Model):
    GENDER_CHOICES = (
        ('L', 'Laki-laki'),
        ('P', 'Perempuan'),
    )

    STATUS_CHOICES = (
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('moved', 'Moved'),
    )

    full_name = models.CharField(max_length=100)
    nickname = models.CharField(max_length=100, blank=True, null=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    birth_date = models.DateField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    member_status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default='active'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tm_member' # Memaksa nama tabel sesuai ERD

    def __str__(self):
        return self.full_name


class Guest(models.Model):
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True, null=True)
    visit_count = models.IntegerField(default=0)
    first_visit = models.DateField(blank=True, null=True)
    last_visit = models.DateField(blank=True, null=True)
    converted_to_member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    face_encoding = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 't_guest'

    def __str__(self):
        return self.full_name


class MemberFaceEmbedding(models.Model):
    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    face_encoding = models.TextField()
    image_path = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 't_member_face_embedding'


# ==========================================
# 2. TRANSIT & VALIDASI (TIMELINE RECORD)
# ==========================================

class TimelineDataRecord(models.Model):
    DETECTION_STATUS = (
        ('recognized', 'Recognized'),
        ('ambiguous', 'Ambiguous'),
        ('guest', 'Guest'),
        ('impossible', 'Impossible'),
    )

    VALIDATION_STATUS = (
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
        ('guest_confirmed', 'Guest Confirmed'),
    )

    capture_time = models.DateTimeField()
    image_path = models.CharField(max_length=255, blank=True, null=True)
    face_encoding = models.TextField(blank=True, null=True)

    detection_status = models.CharField(max_length=50, choices=DETECTION_STATUS)
    confidence = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)

    matched_member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ai_matches'
    )

    validation_status = models.CharField(
        max_length=50,
        choices=VALIDATION_STATUS,
        default='pending'
    )

    validated_at = models.DateTimeField(blank=True, null=True)

    final_member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='final_validations'
    )

    final_guest = models.ForeignKey(
        Guest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 't_timlinedata_record'


# ==========================================
# 3. FINAL ABSENSI
# ==========================================

class Attendance(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    guest = models.ForeignKey(
        Guest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    facedetection = models.OneToOneField(
        TimelineDataRecord, # Relasi sudah dirubah ke model yang baru
        on_delete=models.CASCADE
    )

    attendance_date = models.DateField()
    check_in_time = models.DateTimeField()
    confidence = models.DecimalField(max_digits=5, decimal_places=2)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 't_attendance'


# ==========================================
# 4. USER & AI CONVERSATION
# ==========================================

class AIConversation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    langfuse_threadid = models.CharField(max_length=100, blank=True, null=True)
    conversation_title = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 't_aiconversation'


# ==========================================
# 5. SUMMARY REPORT
# ==========================================

class SummaryReport(models.Model):
    report_date = models.DateField(unique=True)
    total_members = models.IntegerField(default=0)
    total_guests = models.IntegerField(default=0)
    total_attendance = models.IntegerField(default=0)
    report_summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 't_summary_report'
        ordering = ['-report_date']

    def __str__(self):
        return f"Summary for {self.report_date}"