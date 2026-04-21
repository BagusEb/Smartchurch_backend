from django.db import models


class ChatHistory(models.Model):
    id = models.AutoField(primary_key=True, serialize=False, verbose_name="ID")
    session_id = models.TextField(blank=True, null=True)
    message = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "chat_history"
