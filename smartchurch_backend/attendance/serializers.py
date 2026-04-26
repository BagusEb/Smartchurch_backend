from rest_framework import serializers
from django.contrib.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    Member,
    Guest,
    MemberFaceEmbedding,
    TimelineDataRecord,
    Attendance,
    AIConversation,
    SummaryReport,
    UserProfile,
)


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = "__all__"


class GuestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guest
        fields = "__all__"


class MemberFaceEmbeddingSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberFaceEmbedding
        fields = "__all__"


class TimelineDataRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineDataRecord
        fields = "__all__"


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"


class AIConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIConversation
        fields = "__all__"


class SummaryReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = SummaryReport
        fields = "__all__"


# ================= CUSTOM JWT SERIALIZER =================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Ambil role dari tabel t_user_role (model UserProfile) terlebih dahulu.
        profile = UserProfile.objects.filter(user=user).only("role").first()
        if profile and profile.role:
            token["role"] = profile.role
        else:
            # Fallback ke relasi profile jika ada, lalu default.
            token["role"] = getattr(getattr(user, "profile", None), "role", "admin")
        return token


# ============================================================
#  SERIALIZER KHUSUS UNTUK CRUD AKUN PENGGUNA (VERSI LENGKAP)
# ============================================================
class UserWithProfileSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "role",
        ]
        extra_kwargs = {
            "password": {"write_only": True, "required": False},
            "email": {"required": True},
        }

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", {})
        role = profile_data.get("role", "leader")

        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            is_active=validated_data.get("is_active", True),
        )
        user.set_password(validated_data["password"])
        user.save()

        user.profile.role = role
        user.profile.save()
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", {})

        instance.username = validated_data.get("username", instance.username)
        instance.email = validated_data.get("email", instance.email)  # <-- UPDATE EMAIL
        instance.first_name = validated_data.get(
            "first_name", instance.first_name
        )  # <-- UPDATE FIRST NAME
        instance.last_name = validated_data.get(
            "last_name", instance.last_name
        )  # <-- UPDATE LAST NAME
        instance.is_active = validated_data.get("is_active", instance.is_active)

        if "password" in validated_data and validated_data["password"]:
            instance.set_password(validated_data["password"])
        instance.save()

        if "role" in profile_data:
            instance.profile.role = profile_data["role"]
            instance.profile.save()

        return instance
