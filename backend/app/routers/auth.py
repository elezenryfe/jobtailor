from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas, auth, database

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/google", response_model=schemas.Token)
def google_login(payload: schemas.GoogleAuthRequest, db: Session = Depends(database.get_db)):
    # Verify Google token
    userinfo = auth.verify_google_token(payload.credential)
    google_sub = userinfo["sub"]
    email = userinfo.get("email")
    name = userinfo.get("name")

    if not email:
        raise HTTPException(400, "Google account missing email")

    # Find or create user
    is_new_user = False
    user = db.query(models.User).filter(models.User.google_sub == google_sub).first()
    if not user:
        # Also check if email already exists (another Google account with same email? Unlikely but safe)
        existing_email = db.query(models.User).filter(models.User.email == email).first()
        if existing_email:
            raise HTTPException(400, "An account with this email already exists")
        user = models.User(
            email=email,
            google_sub=google_sub,
            name=name
        )
        db.add(user)
        is_new_user = True
    else:
        user.name = name  # Update name in case it changed
        db.add(user)

    db.commit()
    db.refresh(user)

    # Generate our own JWT
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer", "is_new_user": is_new_user}

@router.get("/me", response_model=schemas.UserOut)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@router.patch("/profile", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.ProfileUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(database.get_db)
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.email is not None:
        existing = db.query(models.User).filter(
            models.User.email == payload.email,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(400, "An account with this email already exists")
        current_user.email = payload.email
    db.commit()
    db.refresh(current_user)
    return current_user