from datetime import timedelta
from typing import List

from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import models, schemas, utils
import auth
import database
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Разрешаем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=database.engine)

# Зависимость для получения DB сессии
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Регистрация пользователя
@app.post("/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = auth.get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Пользователь уже зарегистрирован")
    hashed_password = utils.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password, country=user.country)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# Получение токена
@app.post("/token")
def login(form_data: schemas.UserCreate, db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    access_token_expires = timedelta(minutes=utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = utils.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str, sender: WebSocket):
        for connection in self.active_connections:
            if connection != sender:
                await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print(f"New WebSocket connection from: {websocket.client}")
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received data: {data}")
            await manager.broadcast(data, websocket)
    except WebSocketDisconnect:
        print(f"Client disconnected: {websocket.client}")
        manager.disconnect(websocket)