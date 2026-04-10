import os
import random
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.getenv("SUPABASE_URL")
key: str = os.getenv("SUPABASE_KEY")

if not url or not key or "your-supabase" in url:
    print("ERROR: Please configure SUPABASE_URL and SUPABASE_KEY in the .env file.")
    exit(1)

supabase: Client = create_client(url, key)

print("--- Starting Supabase Data Seeding ---")

# 1. Fetch Programs to Ensure Base Schema Exists
response = supabase.table("programs").select("*").execute()
if not response.data:
    print("Inserting master programs...")
    supabase.table("programs").insert([
        {'code': 'CS', 'name': 'Computer Science'},
        {'code': 'AIE', 'name': 'Artificial Intelligence Engineering'},
        {'code': 'AIS', 'name': 'Artificial Intelligence Science'},
        {'code': 'CE', 'name': 'Computer Engineering'}
    ]).execute()
    response = supabase.table("programs").select("*").execute()

programs = {p['code']: p['id'] for p in response.data}

# 2. Extract Structure from Excel and Create Courses
print("Parsing Excel for Course Mappings...")
df_map = pd.read_excel('../SO-Coverage-V2 - Copy.xlsx', sheet_name='ALL', header=None)
so_row = df_map.iloc[1]
excel_data = df_map.iloc[2:].reset_index(drop=True)

seed_mappings = []
for idx, row in excel_data.iterrows():
    c_code = row[0]
    if pd.isna(c_code) or str(c_code).strip() == '': continue
    active_sos = set()
    for col_idx in range(2, len(row)-1):
        if row[col_idx] == 1:
            so_name = str(so_row[col_idx]).strip()
            if so_name.startswith('SO'):
                active_sos.add(int(so_name.replace('SO', '')))
    if active_sos:
        seed_mappings.append(list(active_sos))

if not seed_mappings:
    seed_mappings = [[1, 2, 6], [2, 3, 5], [1, 2, 3, 4, 5, 6]]

print("Generating 150 diverse courses...")
courses_insert = []
course_so_mappings_insert = []
term_metrics_insert = []

terms = ['2020F', '2021S', '2021F', '2022S', '2022F', '2023S', '2023F', '2024S']

# Clean existing courses to prevent duplicates during seed
supabase.table("courses").delete().neq("id", 0).execute()

for i in range(1, 151):
    prog_code = random.choice(['CS', 'AIE', 'CE'])
    c_code = f'{prog_code}{300+i}'
    
    # Send course
    course_res = supabase.table("courses").insert({
        'course_code': c_code,
        'course_name': f'Synthetic Course {i}',
        'is_active': True
    }).execute()
    
    course_id = course_res.data[0]['id']
    
    # Assign to 1, 2, or 3 random programs (Many-to-Many relation)
    num_progs = random.randint(1, 3)
    selected_progs = random.sample(list(programs.values()), num_progs)
    
    # Needs to be batched or executed individually depending on size, here individual is fine for 150 courses
    for p_id in selected_progs:
        supabase.table("program_courses").insert({
            'program_id': p_id,
            'course_id': course_id
        }).execute()
    
    course_id = course_res.data[0]['id']
    
    # Assign SO mappings
    base_mapping = random.choice(seed_mappings).copy()
    if random.random() < 0.3 and len(base_mapping) > 1:
        base_mapping.pop(random.randint(0, len(base_mapping)-1))
        
    for so_idx in base_mapping:
        course_so_mappings_insert.append({
            'course_id': course_id,
            'so_index': so_idx,
            'so_weight': 1.0
        })

    # Generate Terms
    ctype = random.choices(['normal', 'degrading', 'hard'], weights=[0.70, 0.20, 0.10])[0]
    starting_health = random.uniform(75, 88) if ctype == 'normal' else (random.uniform(70, 80) if ctype == 'degrading' else random.uniform(62, 70))
    degradation_rate = random.uniform(1.5, 3.5) if ctype == 'degrading' else random.uniform(-0.5, 0.5)

    previous_so_index = None
    for term_idx, term in enumerate(terms):
        current_health = starting_health - (degradation_rate * term_idx)
        avg_score = min(100, max(0, current_health + random.uniform(-2, 2)))
        pass_rate = min(100, max(0, avg_score + random.uniform(-5, 10)))
        
        record = {
            'course_id': course_id,
            'academic_term': term,
            'avg_score': round(avg_score, 2),
            'pass_rate': round(pass_rate, 2),
        }
        
        active_so_values = []
        for so_idx in base_mapping:
            val = min(100, max(0, avg_score + random.uniform(-5, 5)))
            record[f'so{so_idx}_attainment'] = round(val, 2)
            active_so_values.append(val)
            
        composite_so = sum(active_so_values) / len(active_so_values) if active_so_values else 0
        trend = composite_so - previous_so_index if previous_so_index is not None else 0
        previous_so_index = composite_so
        
        record['composite_so_index'] = round(composite_so, 2)
        record['trend_value'] = round(trend, 2)
        term_metrics_insert.append(record)

print(f"Batch Inserting {len(course_so_mappings_insert)} SO mappings...")
# Supabase limits inserts to 1000 rows, batch it
for i in range(0, len(course_so_mappings_insert), 1000):
    supabase.table("course_so_mappings").insert(course_so_mappings_insert[i:i+1000]).execute()

print(f"Batch Inserting {len(term_metrics_insert)} term metrics...")
for i in range(0, len(term_metrics_insert), 1000):
    supabase.table("term_metrics").insert(term_metrics_insert[i:i+1000]).execute()

print("✅ SUCCESS! Real database seeded with robust ABET constraints.")
