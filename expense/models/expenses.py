from pydantic import BaseModel
from datetime import date

class Expense(BaseModel):
    id: int
    amount: float
    category: str
    date: date
    description: str
