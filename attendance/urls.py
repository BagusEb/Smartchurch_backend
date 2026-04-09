from django.urls import path, include
from . import views
from rest_framework.routers import DefaultRouter
from .views import (
    MemberViewSet, GuestViewSet, MemberFaceEmbeddingViewSet, 
    TimelineDataRecordViewSet, AttendanceViewSet, 
    AIConversationViewSet, SummaryReportViewSet
)

router = DefaultRouter()
router.register(r'members', MemberViewSet)
router.register(r'guests', GuestViewSet)
router.register(r'face-embeddings', MemberFaceEmbeddingViewSet)
router.register(r'timeline-records', TimelineDataRecordViewSet)
router.register(r'attendances', AttendanceViewSet)
router.register(r'ai-conversations', AIConversationViewSet)
router.register(r'summary-reports', SummaryReportViewSet)
router.register(r'manage-users', views.UserManageViewSet, basename='manage-users')

urlpatterns = [
    path('', include(router.urls)),
]