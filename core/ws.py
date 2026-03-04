# core/ws.py
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class BaseConsumer(AsyncJsonWebsocketConsumer):
    group_name = None

    async def connect(self):
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def send_json(self, event):
        await self.send_json({"event": event["event"], "data": event["data"]})

class DashboardConsumer(BaseConsumer):
    group_name = "dashboard"

class FinanceiroConsumer(BaseConsumer):
    group_name = "financeiro"

class FluxoConsumer(BaseConsumer):
    group_name = "fluxo"
