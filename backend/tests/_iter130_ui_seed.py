# iter130 UI seed: throwaway user / retailer / profile tickets / tree-donation orders (all TEST_)
import sys
from datetime import datetime, timezone
from pymongo import MongoClient
db = MongoClient("mongodb://localhost:27017")["addrika_db"]
NOW = datetime.now(timezone.utc).isoformat()
if sys.argv[1] == "seed":
    db.users.delete_many({"user_id": "TEST_UI_USER"})
    db.users.insert_one({"user_id": "TEST_UI_USER", "email": "test_ui_user_iter130@example.com", "name": "TEST UI User", "created_at": NOW})
    db.retailers.delete_many({"retailer_id": "RTL_TEST_UI_DEL"})
    db.retailers.insert_one({"retailer_id": "RTL_TEST_UI_DEL", "business_name": "TEST_UI Throwaway Shop", "email": "test_ui_shop@example.com",
                             "status": "active", "created_at": NOW, "gstin": "", "phone": "9000000000", "city": "Delhi"})
    for t in ("PCT-TESTUI1", "PCT-TESTUI2", "PCT-TESTUI3"):
        db.profile_change_tickets.delete_many({"ticket_id": t})
        db.profile_change_tickets.insert_one({"id": t, "ticket_id": t, "retailer_id": "RTL_DELHI001", "business_name": "TEST_UI ticket " + t,
                                              "retailer_email": "x@example.com", "change_type": "other", "change_type_label": "Other",
                                              "description": "TEST_iter130 UI", "new_value": "TEST", "status": "pending",
                                              "created_at": "2099-01-01T00:00:00+00:00", "updated_at": NOW})
    db.orders.delete_many({"order_number": {"$in": ["TEST_TREE_UI_A", "TEST_TREE_UI_B"]}})
    db.orders.insert_many([
        {"order_number": "TEST_TREE_UI_A", "billing": {"email": "test_tree_ui_a@example.com", "name": "TEST A"}, "payment_status": "paid",
         "created_at": NOW, "pricing": {"tree_donation": 5, "final_total": 505}},
        {"order_number": "TEST_TREE_UI_B", "billing": {"email": "test_tree_ui_b@example.com", "name": "TEST B"}, "payment_status": "paid",
         "created_at": NOW, "pricing": {"tree_donation": 10, "final_total": 210}},
    ])
    print("seeded")
elif sys.argv[1] == "state":
    print("user", db.users.count_documents({"user_id": "TEST_UI_USER"}))
    print("retailer", db.retailers.count_documents({"retailer_id": "RTL_TEST_UI_DEL"}))
    print("tickets", list(db.profile_change_tickets.find({"ticket_id": {"$regex": "^PCT-TESTUI"}}, {"_id": 0, "ticket_id": 1, "status": 1})))
    print("tree", list(db.orders.find({"order_number": {"$regex": "^TEST_TREE_UI"}}, {"_id": 0, "order_number": 1, "pricing": 1})))
    print("ticket counts", list(db.profile_change_tickets.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}])))
elif sys.argv[1] == "cleanup":
    db.users.delete_many({"user_id": "TEST_UI_USER"})
    db.retailers.delete_many({"retailer_id": "RTL_TEST_UI_DEL"})
    db.profile_change_tickets.delete_many({"ticket_id": {"$regex": "^PCT-TESTUI"}})
    db.orders.delete_many({"order_number": {"$regex": "^TEST_TREE_UI"}})
    print("cleaned")
