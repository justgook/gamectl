package logic


// Component storage using dynamic arrays and sparse sets
Component_Storage :: struct($T: typeid) {
	// Dense array of components
	components: [dynamic]T,
	// Dense array of entity IDs corresponding to components
	entity_ids: [dynamic]int,
	// Sparse array mapping entity IDs to dense array indices
	sparse:     map[int]int,
}

make_storage :: proc($T: typeid) -> Component_Storage(T) {
	return Component_Storage(T) {
		components = make([dynamic]T),
		entity_ids = make([dynamic]int),
		sparse = make(map[int]int),
	}
}

destroy_storage :: proc(storage: ^Component_Storage($T)) {
	delete(storage.components)
	delete(storage.entity_ids)
	delete(storage.sparse)
}

add_component :: proc(storage: ^Component_Storage($T), entity_id: int, component: T) {
	if entity_id in storage.sparse {
		idx := storage.sparse[entity_id]
		storage.components[idx] = component
		return
	}

	append(&storage.components, component)
	append(&storage.entity_ids, entity_id)
	storage.sparse[entity_id] = len(storage.components) - 1
}


delete_component :: proc(storage: ^Component_Storage($T), entity_id: int) -> (ok: bool) {
	// Get the index from the sparse array
	dense_idx, exists := storage.sparse[entity_id]
	if !exists {
		return false
	}

	unordered_remove(&storage.components, dense_idx)
	unordered_remove(&storage.entity_ids, dense_idx)

	// Update the sparse map for the moved entity if there was one
	if len(storage.entity_ids) > dense_idx {
		moved_entity_id := storage.entity_ids[dense_idx]
		storage.sparse[moved_entity_id] = dense_idx
	}

	delete_key(&storage.sparse, entity_id)

	return true
}

@(require_results)
get_component :: proc(storage: ^Component_Storage($T), entity_id: int) -> (^T, bool) #optional_ok {
	if idx, ok := storage.sparse[entity_id]; ok {
		return &storage.components[idx], true
	}

	return nil, false
}

@(require_results)
has_component :: proc(storage: ^Component_Storage($T), entity_id: int) -> bool {
	return entity_id in storage.sparse
}

with_component :: proc(storage: ^Component_Storage($T), entity_id: int, fn: proc(c: ^T)) {
	idx, ok := storage.sparse[entity_id]
	if !ok {
		return
	}

	fn(&storage.components[idx])
}


View1 :: struct($A: typeid) {
	storage_a:     ^Component_Storage(A),
	current_index: int,
}

View2 :: struct($A, $B: typeid) {
	storage_a:     ^Component_Storage(A),
	storage_b:     ^Component_Storage(B),
	current_index: int,
}

View3 :: struct($A, $B, $C: typeid) {
	storage_a:     ^Component_Storage(A),
	storage_b:     ^Component_Storage(B),
	storage_c:     ^Component_Storage(C),
	current_index: int,
}


View4 :: struct($A, $B, $C, $D: typeid) {
	storage_a:     ^Component_Storage(A),
	storage_b:     ^Component_Storage(B),
	storage_c:     ^Component_Storage(C),
	storage_d:     ^Component_Storage(D),
	current_index: int,
}

view :: proc {
	make_view1,
	make_view2,
	make_view3,
	make_view4,
}

@(require_results)
make_view1 :: proc(storage_a: ^Component_Storage($A)) -> View1(A) {
	return View1(A){storage_a = storage_a, current_index = 0}
}

@(require_results)
make_view2 :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
) -> View2(A, B) {
	return View2(A, B){storage_a = storage_a, storage_b = storage_b, current_index = 0}
}

@(require_results)
make_view3 :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
) -> View3(A, B, C) {
	return View3(A, B, C) {
		storage_a = storage_a,
		storage_b = storage_b,
		storage_c = storage_c,
		current_index = 0,
	}
}


@(require_results)
make_view4 :: proc(
	storage_a: ^Component_Storage($A),
	storage_b: ^Component_Storage($B),
	storage_c: ^Component_Storage($C),
	storage_d: ^Component_Storage($D),
) -> View4(A, B, C, D) {
	return View4(A, B, C, D) {
		storage_a = storage_a,
		storage_b = storage_b,
		storage_c = storage_c,
		storage_d = storage_d,
		current_index = 0,
	}
}

each_comonent :: proc(s: ^Component_Storage($A), fn: proc(id: int, c: ^A)) {
	for id, i in s.sparse {
		fn(id, &s.components[i])
	}
}
each :: proc {
	each_comonent,
	each_view1,
	each_view2,
	each_view3,
	each_view4,
}

each_view1 :: proc(view: ^View1($A)) -> (id: int, a: ^A, ok: bool) {
	if ok = view.current_index < len(view.storage_a.entity_ids); ok {
		id = view.storage_a.entity_ids[view.current_index]
		a = &view.storage_a.components[view.current_index]
		view.current_index += 1
	}

	return
}


each_view2 :: proc(view: ^View2($A, $B)) -> (id: int, a: ^A, b: ^B, ok: bool) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		if ok = has_component(view.storage_b, id); ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			view.current_index += 1
			return
		}
		view.current_index += 1
	}
	return
}


each_view3 :: proc(view: ^View3($A, $B, $C)) -> (id: int, a: ^A, b: ^B, c: ^C, ok: bool) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		ok1 := has_component(view.storage_b, id)
		ok2 := has_component(view.storage_c, id)
		if ok = ok1 && ok2; ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			c_idx := view.storage_c.sparse[id]
			c = &view.storage_c.components[c_idx]
			view.current_index += 1
			return
		}
		view.current_index += 1
	}
	return
}


each_view4 :: proc(
	view: ^View4($A, $B, $C, $D),
) -> (
	id: int,
	a: ^A,
	b: ^B,
	c: ^C,
	d: ^D,
	ok: bool,
) {
	for view.current_index < len(view.storage_a.entity_ids) {
		id = view.storage_a.entity_ids[view.current_index]
		ok1 := has_component(view.storage_b, id)
		ok2 := has_component(view.storage_c, id)
		ok3 := has_component(view.storage_d, id)
		if ok = ok1 && ok2 && ok3; ok {
			a = &view.storage_a.components[view.current_index]
			b_idx := view.storage_b.sparse[id]
			b = &view.storage_b.components[b_idx]
			c_idx := view.storage_c.sparse[id]
			c = &view.storage_c.components[c_idx]
			d_idx := view.storage_d.sparse[id]
			d = &view.storage_d.components[d_idx]

			view.current_index += 1
			return
		}
		view.current_index += 1
	}

	return
}
