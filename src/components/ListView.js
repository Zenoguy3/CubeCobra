import React, { Component } from 'react';

import { Input } from 'reactstrap';

import { csrfFetch } from '../util/CSRF';
import { getLabels, sortDeep } from '../util/Sort';
import { arraysEqual, fromEntries } from '../util/Util';

import CubeContext from './CubeContext';
import GroupModalContext from './GroupModalContext';
import PagedTable from './PagedTable';
import SortContext from './SortContext';
import TagContext from './TagContext';
import TagInput from './TagInput';
import withAutocard from './WithAutocard';

const colorCombos = [
  'C',
  'W',
  'U',
  'B',
  'R',
  'G',
  'WU',
  'WB',
  'WR',
  'WG',
  'UB',
  'UR',
  'UG',
  'BR',
  'BG',
  'RG',
  'WUB',
  'WUR',
  'WUG',
  'WBR',
  'WBG',
  'WRG',
  'UBR',
  'UBG',
  'URG',
  'BRG',
  'WUBR',
  'WUBG',
  'WURG',
  'WBRG',
  'UBRG',
  'WUBRG',
];

const AutocardTd = withAutocard('td');

class ListViewRaw extends Component {
  constructor(props) {
    super(props);

    const cardValues = [].concat.apply(
      [],
      this.props.cards.map(({ index, ...card }) => [
        [`tdcheck${index}`, false],
        [`tdversion${index}`, card.cardID],
        [`tdtype${index}`, card.type_line],
        [`tdstatus${index}`, card.status],
        [`tdfinish${index}`, card.finish],
        [`tdcmc${index}`, card.cmc],
        [`tdcolors${index}`, (card.colors || ['C']).join('')],
        [`tdtaginput${index}`, ''],
        [`tags${index}`, (card.tags || []).map((tag) => ({ id: tag, text: tag }))],
      ]),
    );

    this.state = {
      ...fromEntries(cardValues),
      versionDict: {},
    };

    this.handleChange = this.handleChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    this.checkAll = this.checkAll.bind(this);
  }

  updateVersions() {
    const knownIds = new Set(Object.keys(this.state.versionDict));
    const currentIds = this.props.cards.map((card) => card.cardID);
    const newIds = currentIds.filter((id) => !knownIds.has(id));
    if (newIds.length > 0) {
      csrfFetch('/cube/api/getversions', {
        method: 'POST',
        body: JSON.stringify(newIds),
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then((response) => response.json())
        .then((json) => {
          this.setState(({ versionDict }) => ({
            versionDict: { ...versionDict, ...json.dict },
          }));
        });
    }
  }

  componentDidMount() {
    this.updateVersions();
  }

  componentDidUpdate() {
    this.updateVersions();
  }

  async syncCard(index, updated, setStateCallback) {
    const { cube, cubeID, updateCubeCard } = this.props;
    let card = cube[index];

    updated = { ...card, ...updated };
    delete updated.details;

    if (
      updated.cardID === card.cardID &&
      updated.type_line === card.type_line &&
      updated.status === card.status &&
      updated.cmc === card.cmc &&
      arraysEqual(updated.colors, card.colors) &&
      arraysEqual(updated.tags, card.tags) &&
      updated.finish === card.finish
    ) {
      // no need to sync
      return;
    }

    try {
      const response = await csrfFetch(`/cube/api/updatecard/${cubeID}`, {
        method: 'POST',
        body: JSON.stringify({
          src: card,
          updated,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const json = await response.json();

      if (json.success === 'true') {
        const oldCardID = card.cardID;
        card = { ...card, ...updated };
        updateCubeCard(index, card);
        if (updated.cardID !== oldCardID) {
          // changed version
          const getResponse = await fetch(`/cube/api/getcardfromid/${updated.cardID}`);
          const getJson = await getResponse.json();
          updateCubeCard(index, { ...card, details: getJson.card });
        }
        if (setStateCallback) {
          setStateCallback();
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  setTagInput(cardIndex, value) {
    this.setState({
      [`tdtaginput${cardIndex}`]: value,
    });
  }

  tagBlur(cardIndex, tag) {
    if (tag.trim()) {
      this.addTag(cardIndex, {
        id: tag.trim(),
        text: tag.trim(),
      });
    }
  }

  addTag(cardIndex, tag) {
    const name = `tags${cardIndex}`;
    const newTags = [...this.state[name], tag];
    this.setState({
      [name]: newTags,
    });
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) });
  }

  deleteTag(cardIndex, tagIndex) {
    const name = `tags${cardIndex}`;
    const newTags = this.state[name].filter((tag, i) => i !== tagIndex);
    this.setState({
      [name]: newTags,
    });
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) });
  }

  reorderTag(cardIndex, tag, currIndex, newIndex) {
    const name = `tags${cardIndex}`;
    const newTags = [...this.state[name]];
    newTags.splice(currIndex, 1);
    newTags.splice(newIndex, 0, tag);
    this.setState({
      [name]: newTags,
    });
    this.syncCard(cardIndex, { tags: newTags.map((tag) => tag.text) });
  }

  getChecked() {
    return this.props.cards.filter(({ index }) => this.state[`tdcheck${index}`]);
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;
    const index = parseInt(target.getAttribute('data-index'));

    if (target.tagName.toLowerCase() === 'select') {
      const updated = {};
      if (name.startsWith('tdversion')) {
        updated.cardID = value;
      } else if (name.startsWith('tdstatus')) {
        updated.status = value;
      } else if (name.startsWith('tdfinish')) {
        updated.finish = value;
      } else if (name.startsWith('tdcolor')) {
        updated.colors = value === 'C' ? [] : [...value];
      }
      this.syncCard(index, updated, () => {
        this.setState({
          [name]: value,
        });
      });
    } else if (name.startsWith('tdcheck')) {
      this.setState({
        [name]: value,
      });
      let checked = this.getChecked();
      if (value && !checked.some((card) => card.index === index)) {
        checked.push(this.props.cards.find((card) => card.index === index));
      } else if (!value) {
        checked = checked.filter((card) => card.index !== index);
      }
      this.props.setGroupModalCards(checked);
    }
  }

  handleBlur(event) {
    const target = event.target;
    const index = parseInt(target.getAttribute('data-index'));

    const colorString = this.state[`tdcolors${index}`];
    const updated = {
      cardID: this.state[`tdversion${index}`],
      type_line: this.state[`tdtype${index}`],
      status: this.state[`tdstatus${index}`],
      cmc: this.state[`tdcmc${index}`],
      tags: this.state[`tags${index}`].map((tagDict) => tagDict.text),
      colors: colorString === 'C' ? [] : [...colorString],
    };

    // <select>s handled in handleChange above.
    if (target.tagName.toLowerCase() !== 'select') {
      this.syncCard(index, updated);
    }
  }

  checkAll(event) {
    const target = event.target;
    const value = target.checked;

    const entries = this.props.cards.map(({ index }) => [`tdcheck${index}`, value]);
    this.setState(fromEntries(entries));

    this.props.setGroupModalCards(this.props.cards);
  }

  render() {
    const { cards, primary, secondary, changeSort, cardColorClass } = this.props;
    const sorted = sortDeep(cards, primary, secondary);

    const inputProps = (index, field) => ({
      bsSize: 'sm',
      name: `td${field}${index}`,
      'data-index': index,
      onChange: this.handleChange,
      onBlur: this.handleBlur,
      [field === 'check' ? 'checked' : 'value']: this.state[`td${field}${index}`],
    });

    const rows = sorted.map(([label1, group1]) =>
      group1.map(([label2, group2]) =>
        group2.map((card) => (
          <tr key={card.index} className={cardColorClass(card)}>
            <td className="align-middle">
              <Input {...inputProps(card.index, 'check')} type="checkbox" className="d-block mx-auto" />
            </td>
            <AutocardTd className="align-middle text-truncate" card={card}>
              {card.details.name}
            </AutocardTd>
            <td>
              <Input
                {...inputProps(card.index, 'version')}
                type="select"
                style={{ maxWidth: '6rem' }}
                className="w-100"
              >
                {(this.state.versionDict[card.cardID] || []).map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version}
                  </option>
                ))}
              </Input>
            </td>
            <td>
              <Input {...inputProps(card.index, 'type')} type="text" />
            </td>
            <td>
              <Input {...inputProps(card.index, 'status')} type="select">
                {getLabels(null, 'Status').map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </Input>
            </td>
            <td>
              <Input {...inputProps(card.index, 'finish')} type="select">
                {getLabels(null, 'Finish').map((finish) => (
                  <option key={finish}>{finish}</option>
                ))}
              </Input>
            </td>
            <td>
              <Input {...inputProps(card.index, 'cmc')} type="text" style={{ maxWidth: '3rem' }} />
            </td>
            <td>
              <Input {...inputProps(card.index, 'colors')} type="select">
                {colorCombos.map((combo) => (
                  <option key={combo}>{combo}</option>
                ))}
              </Input>
            </td>
            <td style={{ minWidth: '15rem' }}>
              <TagInput
                tags={this.state[`tags${card.index}`]}
                value={this.state[`tdtaginput${card.index}`]}
                name={`tdtaginput${card.index}`}
                onChange={this.handleChange}
                handleInputBlur={this.tagBlur.bind(this, card.index)}
                addTag={this.addTag.bind(this, card.index)}
                deleteTag={this.deleteTag.bind(this, card.index)}
                reorderTag={this.reorderTag.bind(this, card.index)}
              />
            </td>
          </tr>
        )),
      ),
    );

    return (
      <form className="form-inline">
        <PagedTable rows={rows} size="sm">
          <thead>
            <tr>
              <th className="align-middle">
                <Input type="checkbox" className="d-block mx-auto" onChange={this.checkAll} />
              </th>
              <th>Name</th>
              <th>Version</th>
              <th>Type</th>
              <th>Status</th>
              <th>Finish</th>
              <th>CMC</th>
              <th>Color</th>
              <th>Tags</th>
            </tr>
          </thead>
        </PagedTable>
      </form>
    );
  }
}

const ListView = (props) => (
  <SortContext.Consumer>
    {(sortValue) => (
      <TagContext.Consumer>
        {({ cardColorClass }) => (
          <GroupModalContext.Consumer>
            {({ setGroupModalCards, openGroupModal }) => (
              <CubeContext.Consumer>
                {({ cube, cubeID, updateCubeCard }) => (
                  <ListViewRaw
                    {...sortValue}
                    {...{ cardColorClass, setGroupModalCards, openGroupModal, cube, cubeID, updateCubeCard }}
                    {...props}
                  />
                )}
              </CubeContext.Consumer>
            )}
          </GroupModalContext.Consumer>
        )}
      </TagContext.Consumer>
    )}
  </SortContext.Consumer>
);

export default ListView;
