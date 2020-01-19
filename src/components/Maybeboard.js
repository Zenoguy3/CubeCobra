import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';

import { Button, Col, Form, ListGroupItem, Row, Spinner } from 'reactstrap';

import { csrfFetch } from '../util/CSRF';

import AutocompleteInput from './AutocompleteInput';
import ChangelistContext from './ChangelistContext';
import CubeContext from './CubeContext';
import DisplayContext from './DisplayContext';
import Filter from '../util/Filter';
import { getCard } from './EditCollapse';
import LoadingButton from './LoadingButton';
import MaybeboardContext, { MaybeboardContextProvider } from './MaybeboardContext';
import TableView from './TableView';
import { getCardColorClass } from './TagContext';
import withAutocard from './WithAutocard';

const AutocardItem = withAutocard(ListGroupItem);

const MaybeboardListItem = ({ card, className }) => {
  const { canEdit, cubeID } = useContext(CubeContext);
  const { removeMaybeboardCard } = useContext(MaybeboardContext);
  const { addChange } = useContext(ChangelistContext);
  const [loading, setLoading] = useState(false);

  const handleClickCard = useCallback(
    (event) => {
      event.preventDefault();
      addChange({ add: { details: card.details } });
    },
    [card, addChange],
  );

  const handleRemove = useCallback(
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const index = parseInt(event.currentTarget.getAttribute('data-index'));
      if (isNaN(index)) {
        console.error('Bad index');
        return;
      }

      setLoading(true);
      const response = await csrfFetch(`/cube/api/maybe/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({
          remove: [index],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          removeMaybeboardCard(index);
          /* global */ autocard_hide_card();
        } else {
          setLoading(false);
          console.error(json.message);
        }
      }
    },
    [removeMaybeboardCard, cubeID],
  );

  return (
    <AutocardItem
      className={`d-flex card-list-item ${getCardColorClass(card)} ${className || ''}`}
      card={card}
      data-index={card.index}
      onClick={canEdit ? handleClickCard : undefined}
    >
      <div className="name">{card.details.name}</div>
      {canEdit &&
        (loading ? (
          <Spinner size="sm" className="ml-auto" />
        ) : (
          <Button
            size="sm"
            close
            className="ml-auto float-none"
            data-index={card.index}
            onClick={canEdit ? handleRemove : undefined}
          />
        ))}
    </AutocardItem>
  );
};

const MaybeboardView = ({ filter, ...props }) => {
  const { canEdit, cubeID } = useContext(CubeContext);
  const { toggleShowMaybeboard } = useContext(DisplayContext);
  const { maybeboard, addMaybeboardCard } = useContext(MaybeboardContext);
  const addInput = useRef();
  const [loading, setLoading] = useState(false);

  const handleAdd = useCallback(
    async (event, newValue) => {
      event.preventDefault();
      if (!addInput.current) return;
      try {
        setLoading(true);
        const card = await getCard(newValue || addInput.current.value);
        if (!card) {
          setLoading(false);
          return;
        }

        const response = await csrfFetch(`/cube/api/maybe/${cubeID}`, {
          method: 'POST',
          body: JSON.stringify({
            add: [{ details: card }],
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const json = await response.json();
          if (json.success === 'true') {
            addMaybeboardCard({ cardID: card._id, details: card });
          } else {
            console.error(json.message);
          }
        }
        setLoading(false);

        addInput.current.value = '';
        addInput.current.focus();
      } catch (e) {
        console.error(e);
      }
    },
    [addMaybeboardCard, addInput, cubeID],
  );

  const maybeboardIndex = useMemo(() => maybeboard.map((card, index) => ({ ...card, index })), [maybeboard]);

  const filteredMaybeboard = useMemo(() => {
    return filter && filter.length > 0
      ? maybeboardIndex.filter((card) => Filter.filterCard(card, filter))
      : maybeboardIndex;
  }, [filter, maybeboardIndex]);

  return (
    <>
      <Row>
        <Col className="mr-auto">
          <h4>Maybeboard</h4>
        </Col>
        <Col xs="auto">
          <Button color="primary" size="sm" onClick={toggleShowMaybeboard}>
            Hide
            <span className="d-none d-sm-inline">{' Maybeboard'}</span>
          </Button>
        </Col>
      </Row>
      {canEdit && (
        <Form className="mt-2 w-100" onSubmit={handleAdd}>
          <Row noGutters>
            <Col xs="9" sm="auto" className="pr-2">
              <AutocompleteInput
                treeUrl="/cube/api/cardnames"
                treePath="cardnames"
                type="text"
                className="w-100"
                disabled={loading}
                innerRef={addInput}
                onSubmit={handleAdd}
                placeholder="Card to Add"
                autoComplete="off"
                data-lpignore
              />
            </Col>
            <Col xs="3" sm="auto">
              <LoadingButton color="success" type="submit" className="w-100" loading={loading}>
                Add
              </LoadingButton>
            </Col>
          </Row>
        </Form>
      )}
      {maybeboard.length === 0 ? (
        <h5 className="mt-3">
          No cards in maybeboard
          {filter && filter.length > 0 ? ' matching filter.' : '.'}
        </h5>
      ) : (
        <TableView className="mt-3" cards={filteredMaybeboard} rowTag={MaybeboardListItem} noGroupModal {...props} />
      )}
      <hr />
    </>
  );
};

const Maybeboard = ({ initialCards, setOpenCollapse, ...props }) => (
  <MaybeboardContextProvider initialCards={initialCards} setOpenCollapse={setOpenCollapse}>
    <MaybeboardView {...props} />
  </MaybeboardContextProvider>
);

export default Maybeboard;
